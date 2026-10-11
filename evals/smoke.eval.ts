import { defineEval, includes } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  timeoutMs: 180_000,
  cases: [
    {
      id: "book",
      description: "完整预约会先匹配技师，再下单，并带上北京天气。",
      async test(t) {
        await t.send(
          "我叫陈晨，手机 13600004444。请帮我预约 2026-11-28 15:00，60 分钟，力度大的中式推拿。技师用匹配结果的第一位，直接下单。",
        );
        t.succeeded();
        t.toolOrder(["search_technicians", "book_appointment", "get_weather"]);
        t.notCalledTool("save_follow_up");
        t.check(t.reply, includes(/技师/));
        t.check(t.reply, includes(/度|天气/));
      },
    },
    {
      id: "consult",
      description: "问价只检索店内资料，不下单。",
      async test(t) {
        await t.send("中式推拿 60 分钟多少钱？");
        t.succeeded();
        t.calledTool("search_knowledge");
        t.notCalledTool("book_appointment");
        t.notCalledTool("get_weather");
        t.check(t.reply, includes(/298/));
      },
    },
    {
      id: "refuse",
      description: "和按摩房无关的请求直接拒绝。",
      async test(t) {
        await t.send("帮我写一段 Python 快速排序。");
        t.succeeded();
        t.notCalledTool("search_technicians");
        t.notCalledTool("book_appointment");
        t.notCalledTool("search_knowledge");
        t.notCalledTool("get_weather");
        t.check(t.reply, includes(/按摩|预约|不能|无法|只处理|帮不了/));
      },
    },
    {
      id: "incomplete",
      description: "信息不够时追问，不能下单。",
      async test(t) {
        await t.send("我想做个按摩。");
        t.succeeded();
        t.notCalledTool("book_appointment");
        t.notCalledTool("get_weather");
        t.check(t.reply, includes(/手机|时间|哪天|什么时候|姓名|几点/));
      },
    },
  ],
});
