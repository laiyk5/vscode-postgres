# Evaluation

Evaluation (2-5 pages): Summarize what you have verified or evaluated your solution to have solved the problem stated in the report, and compare it to the results of existing tools

Let's consider a common senario: You need to generate a SQL for a database that you're not quite familiar with, or the database has a lot of fields and hard to describe. Let's compare several approach:

1. Generate the sql with a naive LLM:
    1. You describe what the sql do (10s)
    2. You describe what the table likes (around 30s for each table), grows linearly as the number of tables involveds grows, lets assume it as 2 tables. (60s)
    3. LLM generates the answer (10s)
    4. You test the sql (2s)
    5. Because of the lack of knowledge of your tables, you often need to let the llm regenerate with your suggestion. (10s)
    6. 3, 4, 5 might cycle serveral times. Let's assume it goes 2 times. (44s)
    7. Total time: 126s
2. Start the MCP Server Manually.
    1. open a terminal console, start the mcp server manually (60s)
    2. configure the mcp server for the agent (60s)
    3. You describe what the sql do (10s)
    4. LLM generates the answer (10s), with the database context, the answer is accurate.
    5. You test the sql (2s)
    6. Total time: 142s
3. Use the build-in MCP Server
    1. select the database you want to query (5s with at most 3 clicks)
    2. You describe what the sql do (10s)
    3. LLM generates the answer (10s), with the database context, the answer is accurate.
    4. You test the sql (2s)
    5. Total time: 27s

This significantly offload the overhead of using agent to generate SQL.
