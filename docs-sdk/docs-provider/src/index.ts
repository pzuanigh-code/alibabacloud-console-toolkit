import presetWind from "@alicloud/console-toolkit-preset-official";
import globby from "globby";
import * as path from "path";
import * as fs from "fs-extra";
import * as Chain from "webpack-chain";
export type { IDemoOpts } from "@alicloud/console-toolkit-docs-shared";
import { getEnv } from "@alicloud/console-toolkit-shared-utils";

export type IExternalItem =
  | string
  | {
      moduleName: string;
      usePathInDev?: string;
    };

export interface IParams {
  consoleOSId: string;
  chainWebpack?: (configChain: Chain, env: any) => void;
  getDemos?: () => {
    key: string;
    path: string;
    staticMeta?: object;
  }[];
  demoContainerPath?: string;
  demoWrapperPath?: string;
  demoOptsPath?: string;
  initializerPath?: string;
  codesandboxModifierPath?: string;
  getMarkdownEntries?: () => {
    key: string;
    path: string;
    staticMeta?: object;
  }[];
  getNormalEntries?: () => {
    key: string;
    path: string;
    staticMeta?: object;
  }[];
  externals?: IExternalItem[];
  resolveAppServePath?: string;
  output?: string;
}

export default (params: IParams, args) => {
  const env = getEnv();
  if (env.isCloudBuild() && env.buildDestDir) {
    params.output = env.buildDestDir;
  } else {
    params.output = params.output ?? "doc-dist";
  }
  if (!params.getDemos) {
    const cwd = env.workingDir ?? process.cwd();
    const baseDir = path.resolve(cwd, "demos");
    // 默认从demos目录查找demo
    if (fs.existsSync(baseDir)) {
      params.getDemos = () => {
        const paths = globby.sync("**/*.demo.tsx", { cwd: baseDir });
        return paths.map((relativePath) => {
          //  const fileName = path.basename(relativePath)
          const demoName = relativePath.replace(/\.demo\.tsx?$/, "");
          // 对于每个demo，要返回demo key和demo路径
          return {
            key: demoName,
            path: path.resolve(baseDir, relativePath),
          };
        });
      };
    }
  }
  params.consoleOSId = params.consoleOSId || "console-os-demos";

  const presetConfig = presetWind(
    {
      disablePolyfill: true,
      disableErrorOverlay: true,
      typescript: {
        // @ts-ignore
        disableTypeChecker: true,
        useBabel: true,
      },
      useTerserPlugin: true,
      htmlFileName: path.resolve(__dirname, "../src2/index.html"),
      useHappyPack: false,
      // @ts-ignore
      hashPrefix: params.consoleOSId,
      // @ts-ignore
      // output: {
      //   path: params.output
      // }
    },
    args
  );

  presetConfig.plugins.push(
    [
      "@alicloud/console-toolkit-plugin-os",
      {
        id: params.consoleOSId,
        cssPrefix: "html",
      },
    ],
    [require.resolve("./main-plugin"), params],
    require.resolve("./config-webpack-plugin")
  );

  return presetConfig;
};