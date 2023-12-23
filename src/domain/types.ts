export type OllamaResponse = {
  model: string;
  created_at: Date;
  response: string;
  context: number[];
  done: boolean;
  total_duration: number;
  load_duration: number;
  sample_count: number;
  sample_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
};

export type OllamaRequestOptions = {
  num_keep: number;
  seed: number;
  num_predict: number;
  top_k: number;
  top_p: number;
  tfs_z: number;
  typical_p: number;
  repeat_last_n: number;
  temperature: number;
  repeat_penalty: number;
  presence_penalty: number;
  frequency_penalty: number;
  mirostat: number;
  mirostat_tau: number;
  mirostat_eta: number;
  penalize_newline: boolean;
  stop: string[];
  numa: boolean;
  num_ctx: number;
  num_batch: number;
  num_gqa: number;
  num_gpu: number;
  main_gpu: number;
  low_vram: boolean;
  f16_kv: boolean;
  logits_all: boolean;
  vocab_only: boolean;
  use_mmap: boolean;
  use_mlock: boolean;
  embedding_only: boolean;
  rope_frequency_base: number;
  rope_frequency_scale: number;
  num_thread: number;
}

export type OllamaRequest = {
  model: string,
  prompt: string,
  format?: 'json',
  options?: Partial<OllamaRequestOptions>,
  template?: string,
  system?: string,
  context?: number[],
  stream?: boolean,
  raw?: boolean
}
