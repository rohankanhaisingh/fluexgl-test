const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    mode: "development",
    entry: "./src/index.ts",
    devtool: "source-map",
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
        clean: true
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "DSP Test",
            templateContent: `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>

  </body>
</html>`
        })
    ],
    devServer: {
        port: 3000,
        static: {
            directory: path.join(__dirname, "dist")
        },
        hot: true
    }
};
