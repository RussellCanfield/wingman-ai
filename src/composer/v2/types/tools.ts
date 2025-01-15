export type FileTarget = {
    type: 'CREATE' | 'MODIFY' | 'QUESTION';
    path?: string;
    folderPath?: string;
    description: string;
}

export type UserIntent = {
    task: string;
    targets: FileTarget[];
}