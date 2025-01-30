export type FileTarget = {
    type: 'CREATE' | 'MODIFY' | 'ANALYZE';
    path?: string;
    description: string;
}

export type UserIntent = {
    task: string;
    targets: FileTarget[];
}