module.exports = {
	apps: [
		{
			name: "learn-mcp-server",
			script: "./node dist/bin.js shttp",
			args: `start --port ${process.env.PORT || 8080} --keepAliveTimeout 70000`,
			node_args: "",
			watch: false,
			autorestart: true,
		},
	],
};
