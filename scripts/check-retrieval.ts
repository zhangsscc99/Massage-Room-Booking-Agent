import { checkRetrieval } from "../bot/lib/retrieve.ts";

const report = checkRetrieval();
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
