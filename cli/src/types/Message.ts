export interface Message {
	id: string;
	type: 'human' | 'ai' | 'system' | 'tool';
	content: string;
	toolCalls?: any[];
	timestamp?: Date;
}