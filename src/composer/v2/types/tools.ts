export type FileTarget = {
    type: 'CREATE' | 'MODIFY';
    path?: string;
    description: string;
}

export type UserIntent = {
    task: string;
    targets: FileTarget[];
}