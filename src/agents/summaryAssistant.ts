import { RunnableSequence, RunnableMap, RunnableLambda } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
// import { ChatOpenAI } from '@langchain/openai';

const summaryPrompt = `
You are an AI model who is expert at summarize the key points, concise summary of main ideas. There may be spelling errors, please correct them based on the context.
The given {query} is a short video copywriting, try not to change the original meaning, generate text that conforms to Mindmap, and output it in markdown format.
Since you are a writing summary assistant, you would not perform web searches.

Example:
1. Short video copywriting: 大家好！今天我要为大家介绍一款非常棒的护肝产品——【护肝片】！现代生活节奏快，工作压力大，很多朋友都有熬夜、饮酒等不良习惯，这些都会对我们的肝脏造成负担。肝脏是我们身体的重要器官，负责解毒、代谢等多项功能，保护肝脏健康至关重要。【护肝片】精选天然草本成分，科学配比，专为保护肝脏设计。它能够有效促进肝细胞再生，增强肝脏解毒功能，帮助修复受损肝细胞，减轻肝脏负担。主要成分包括：水飞蓟素：具有强大的抗氧化作用，保护肝细胞免受自由基的损伤。五味子：有助于提高肝脏的解毒能力，促进肝细胞再生。丹参：改善肝脏血液循环，增强肝脏功能。适合人群：经常熬夜、饮酒的人群；长期服用药物的人群；肝功能不佳的人群。希望这段文案能帮助到您！如果有任何修改或进一步的需求，请随时告诉我。
Rephrased: 
# 一款非常棒的护肝产品
## 现代生活节奏快，工作压力大

- 熬夜
- 饮酒
- 不良习惯
- 肝脏负担

## 【护肝片】精选天然草本成分

- 科学配比
- 修复受损肝细胞
- 增强肝脏解毒功能
- 促进肝细胞再生
- 保护肝脏设计
- 减轻肝脏负担

## 主要成分
### 水飞蓟素

- 抗氧化作用
- 保护肝细胞

### 五味子

- 提高解毒能力
- 促进肝细胞再生

### 丹参

- 改善血液循环
- 增强肝脏功能

## 适合人群

- 经常熬夜
- 长期服用药物
- 饮酒

Conversation:
{chat_history}

Short video copywriting: {query}
Rephrased short video copywriting:
`;

type SummaryInput = {
  chat_history: BaseMessage[];
  query: string;
};

const strParser = new StringOutputParser();

const createSuggestionGeneratorChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: SummaryInput) => {
        return formatChatHistoryAsString(input.chat_history);
      },
      query: (input: SummaryInput) => {
        return input.query;
      },
    }),
    PromptTemplate.fromTemplate(summaryPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      return input;
    }),
  ]);
};

const generateSummary = (
  input: SummaryInput,
  llm: BaseChatModel,
) => {
  // (llm as unknown as ChatOpenAI).temperature = 0;
  const summaryChain = createSuggestionGeneratorChain(llm);
  return summaryChain.invoke(input);
};

export default generateSummary;
