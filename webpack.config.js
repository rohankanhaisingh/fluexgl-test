const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const fs = require("fs");
const { url } = require("inspector");

const lastArgument = process.argv[process.argv.length - 1],
    entryFileName = lastArgument !== "--open" ? "test/" + lastArgument + ".ts" : "index-main.ts";

module.exports = {
    mode: "development",
    entry: "./src/" + entryFileName,
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
            title: "FluexGL Test Environment",
            template: path.resolve(__dirname, "src", "index.html")
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, "src", "bin"),
                    to: path.resolve(__dirname, "dist", "bin")
                }
            ]
        })
    ],
    devServer: {
        port: 3000,
        static: {
            directory: path.join(__dirname, "dist")
        },
        hot: true,
        open: false
    }
};
