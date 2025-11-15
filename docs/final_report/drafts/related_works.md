# Related Work

> Related Work (1 page): Present your fact-finding about existing solutions toward solving the problem you have stated

To connect your database to your copilot Agent:

1. programmers should learn how to configure a mcp database server
2. start a dedicated MCP server for each database
3. config the mcp database server in vscode so the agent can start a mcp client.
4. unselect all unnecessary mcp server as it would provide too much tools for your agent, which significantly slow down the agent.

- [executeautomation/mcp-database-server](https://github.com/executeautomation/mcp-database-server) is a package that implement a simple stdio-based MCP database server. But this server only implement a  stdio-based server.
- [VS Code Extension-guides/ai/mcp](https://code.visualstudio.com/api/extension-guides/ai/mcp) VS Code entension guides told us how to integrate the experience into VS Code.
- [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk) MCP SDK for Typescript. This guides us implement a MCP server.
