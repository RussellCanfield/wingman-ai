from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.chains import LLMChain
from langchain.llms.llamacpp import LlamaCpp
from langchain.prompts import PromptTemplate
from langchain.schema.output_parser import StrOutputParser
from langchain.callbacks.base import BaseCallbackHandler
from langchain.output_parsers.combining import CombiningOutputParser

from llama_cpp import Llama

llm = LlamaCpp(
    model_path="./models/deepseek-coder-1.3b-instruct.Q4_0.gguf",
    n_gpu_layers=1,
    n_batch=512,
    n_ctx=2048,
    f16_kv=True,
    #callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]),
    verbose=True,
)

# str_parser = StrOutputParser()
# combining_parser = CombiningOutputParser(parsers=[str_parser])

#print(llm._call("The first man on the moon was?"))

llm = Llama(model_path="./models/deepseek-coder-1.3b-instruct.Q4_0.gguf",
            n_ctx=512, last_n_tokens_size=256, n_threads=4, n_gpu_layers=1)

prompt = """You are an AI programming assistant, utilizing the Deepseek Coder model, developed by Deepseek Company, and you only answer questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will refuse to answer.
        ### Instruction:
        What is javascript?
        ### Response:
      """

stream = llm.create_completion(prompt, max_tokens=1200, stop=["### Instruction:", "### Response:"], temperature=0, stream=True)

result = ""
for output in stream:
    result += output['choices'][0]['text']
print ("stream = True")
print(result)