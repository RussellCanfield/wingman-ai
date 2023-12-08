use llama_cpp_rs::{
    options::{ModelOptions, PredictOptions},
    LLama,
};

pub fn greet() -> String {
    return "Hello, llm-wasm!".to_string();
}

extern "C" {
    fn read_file(path: &str) -> String;
}

pub fn main() {
    let model_options = ModelOptions::default();

    let llama = LLama::new(
        "./src/deepseek-coder-1.3b-instruct.Q4_0.gguf".into(),
        &model_options,
    )
    .unwrap();

    let predict_options = PredictOptions {
        token_callback: Some(Box::new(|token| {
            println!("token1: {}", token);

            true
        })),
        ..Default::default()
    };

    llama
        .predict(
            "what are the national animals of india".into(),
            predict_options,
        )
        .unwrap();
}
