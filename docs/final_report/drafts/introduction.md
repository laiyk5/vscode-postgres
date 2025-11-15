# Introduction

> Introduction (1-1.5 pages): Summarize the background, the problem you solve, the solutions taken by existing approaches/tools, the reason why existing tools/approaches are still inadequate to solve the problem, your idea, your solution, evaluation.

The problem I solve: I integrated a database MCP server into [VSCode Extension vscode-postgres](https://github.com/Borvik/vscode-postgres). The MCP server would start automatically, register into VSCode automatically. So this feature is right out of box. We also make this feature zero-config through designs like like invoking a database configure dialog if the MCP server is not configured with a database connection when the MCP tools are called. It also auto-switch the underlying database connection of the MCP server as the connection specified by the user changes.

With this zero-config, out-of-the-box database MCP server, agent with database context is never that handy before. This significantly lower the difficulties of using AI Agent with private database access. The integration of the existing postgres extension also reuse the existing facilities like connection manager and editor state manager.

