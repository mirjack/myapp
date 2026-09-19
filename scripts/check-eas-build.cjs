if (process.env.EAS_BUILD_PROFILE === "production") {
  require("./check-release.cjs");
}
