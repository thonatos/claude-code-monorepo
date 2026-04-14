import path from "node:path";

export default {
  artusx: {
    enable: true,
    package: "@artusx/core",
  },
  telegram: {
    enable: true,
    path: path.resolve(__dirname, "../plugins/telegram"),
  },
  acp: {
    enable: true,
    path: path.resolve(__dirname, "../plugins/acp"),
  },
};
