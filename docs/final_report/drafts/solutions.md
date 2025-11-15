# Solutions

> Solution (2-3 pages): Present your solution, probably with algorithms, figures, code listing, and an example walkthrough to assist you in presenting your solution. Relate the content to each topic covered in CS5351.

* Vedio demo of the build-in MCP server [![【Master/Software Engineering】DB MCP Server DEMO - VSCode Extension](https://i0.hdslb.com/bfs/archive/22dda0c58be2af0c269c46d919244894ba868ed5.jpg@672w_378h_1c.webp)](https://www.bilibili.com/video/BV17NCPBmEVA/?share_source=copy_web&vd_source=216745858ec9a3dce2b0d440d7ae8a34)

Sprint2 description:

1. feature: Write a database MCP server
2. feature: auto-start
3. feature: auto connection swtiching feature
4. feature: quick popup connection selection when connection is not set.
5. project: update dependencies for compatibility, wait for merging.

Technical Dept:

1. The MCP server use an unsafe sql execution function for the read query tool, which might accidently modify the database. But every tool execution needs a user approval, so this is not an unacceptable threat.
