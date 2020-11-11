import { getOptions } from "loader-utils";
import postcss from "postcss";
import postcssPackage from "postcss/package.json";
import { satisfies } from "semver";
import * as qs from "query-string";

module.exports = async function fusionCssLoader(
  this: any,
  content,
  sourceMap,
  meta
) {
  const callback = this.async();
  const options = getOptions(this);
  const resourceQuery = qs.parse(this.resourceQuery || "");

  let fusionPrefix = resourceQuery.fusionPrefix ?? options.fusionPrefix;
  let fusionVarScope = resourceQuery.fusionVarScope ?? options.fusionVarScope;
  let styleContainer = resourceQuery.styleContainer ?? options.styleContainer;
  let selectorTransformer = options.selectorTransformer;

  let root;

  // Reuse PostCSS AST from other loaders
  // https://github.com/webpack-contrib/postcss-loader/blob/6c9f6b5058158f5cbee81e410c94abb23b85bb56/src/index.js#L86
  if (
    meta &&
    meta.ast &&
    meta.ast.type === "postcss" &&
    satisfies(meta.ast.version, `^${postcssPackage.version}`)
  ) {
    ({ root } = meta.ast);
  }

  const selectorTransformers = [] as any[];
  if (typeof selectorTransformer === "function") {
    selectorTransformers.push(selectorTransformer);
  }

  if (typeof fusionVarScope === "string") {
    selectorTransformers.push(selector => {
      if (selector === ":root") {
        return fusionVarScope;
      }
    });
  }

  if (typeof styleContainer === "string") {
    selectorTransformers.push(function(selector: string) {
      // 未来可以使用 postcss-selector-parser 做更精确的识别和判断

      // 将明显的根容器选择器替换成styleContainer
      if (selector === "html" || selector === "body" || selector === ":host") {
        return styleContainer;
      }
      // 不能在前面插入styleContainer的选择器，不作处理
      if (
        selector.includes("html") ||
        selector.includes(":root") ||
        selector.includes(":host") ||
        selector.includes(styleContainer)
      ) {
        return selector;
      }
      // fusion组件样式，不做处理
      // 组件的样式隔离通过 fusionPrefix 替换来完成
      if (selector.startsWith(".next-")) {
        return selector;
      }
      // 其他选择器直接在前面插入styleContainer
      return styleContainer + " " + selector;
    });
  }

  if (typeof fusionPrefix === "string") {
    selectorTransformers.push(selector => {
      if (selector.startsWith(".next-")) {
        return selector.replace(/\.next-/g, fusionPrefix);
      }
    });
  }

  if (selectorTransformers.length === 0) {
    throw new Error(
      `Must provide at least one of the loader options: fusionPrefix or fusionVarScope or selectorTransformer or styleContainer`
    );
  }

  const result = await postcss(
    selectorTransformers.map(m => modifySelectorPostcssPlugin(m))
  ).process(root || content, {
    from: undefined
  });

  const ast = {
    type: "postcss",
    version: result.processor.version,
    root: result.root
  };

  callback(null, result.css, undefined, { ast });
};

function modifySelectorPostcssPlugin(transform) {
  return function(css) {
    css.walkRules(rule => {
      const newSelectors = rule.selectors.map(selector => {
        const res = transform(selector);
        if (res) return res;
        return selector;
      });
      rule.selectors = newSelectors;
    });
  };
}