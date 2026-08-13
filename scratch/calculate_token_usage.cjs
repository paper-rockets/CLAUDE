const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFilePath = 'C:\\Users\\macie\\.gemini\\antigravity\\brain\\1d236053-0144-4b02-888b-f7114b45383e\\.system_generated\\logs\\transcript.jsonl';

async function parseLogs() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let totalCharactersSent = 0;
    let stepCount = 0;
    let toolCallsCount = {};
    let largeReads = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        stepCount++;

        // Estimate character count of this step
        const contentLen = entry.content ? entry.content.length : 0;
        totalCharactersSent += contentLen;

        // Track tool calls
        if (entry.tool_calls) {
            entry.tool_calls.forEach(tc => {
                toolCallsCount[tc.name] = (toolCallsCount[tc.name] || 0) + 1;
                if (tc.name === 'view_file') {
                    const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
                    largeReads.push({
                        step: entry.step_index,
                        file: args.AbsolutePath || args.TargetFile,
                        lines: `${args.StartLine || 1}-${args.EndLine || 'end'}`
                    });
                }
            });
        }
    }

    console.log("=== USAGE LOG ANALYSIS ===");
    console.log("Total Steps in Transcript:", stepCount);
    console.log("Estimated Total Characters Processed (input + output):", totalCharactersSent);
    console.log("Estimated Token Count (approx 4 chars per token):", Math.round(totalCharactersSent / 4));
    console.log("\nTool Call Frequencies:");
    console.dir(toolCallsCount);
    console.log("\nFile Reads tracked in transcript:");
    largeReads.forEach(r => {
        console.log(`- Step ${r.step}: read ${r.file} (lines: ${r.lines})`);
    });
}

parseLogs().catch(console.error);
