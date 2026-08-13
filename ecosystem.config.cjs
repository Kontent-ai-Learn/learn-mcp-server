module.exports = {
	apps: [
		{
			name: "learn-mcp-server",
			script: "./dist/bin.js",
			args: "shttp",
			node_args: "",
			watch: false,
			autorestart: true,
		},
	],
};
