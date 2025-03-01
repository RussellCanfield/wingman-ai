import type { ComposerMessage, ComposerResponse, FileSearchResult, GraphState } from "@shared/types/v2/Composer";
import type { AppMessage } from "@shared/types/v2/Message";
import type { AppState, Thread } from "@shared/types/Settings";
import type { AddMessageToThreadEvent, RenameThreadEvent } from '@shared/types/Events';
import type React from "react";
import { createContext, type FC, type PropsWithChildren, useContext, useEffect, useRef, useState } from "react"
import { vscode } from "../utilities/vscode";

interface ComposerContextType {
  composerMessages: ComposerMessage[];
  setComposerMessages: React.Dispatch<React.SetStateAction<ComposerMessage[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  clearActiveMessage: () => void;
  activeMessage: ComposerMessage | undefined;
  activeFiles: FileSearchResult[];
  setActiveFiles: React.Dispatch<React.SetStateAction<FileSearchResult[]>>;
  // Thread management
  threads: Thread[];
  activeThreadGraphState?: GraphState;
  activeThread: Thread | null;
  createThread: (title: string) => void;
  switchThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  renameThread: (threadId: string, newTitle: string) => void;
  branchThread: (threadId: string) => void;
}

const ComposerContext = createContext<ComposerContextType | undefined>(undefined);

export const useComposerContext = () => {
  const context = useContext(ComposerContext);
  if (!context) throw new Error("useComposerContext must be used within ComposerProvider");
  return context;
};

export const ComposerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [composerMessages, setComposerMessages] = useState<ComposerMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeMessage, setActiveMessage] = useState<ComposerMessage | undefined>();
  const threadGraphStateRef = useRef(new Map());
  const [chips, setChips] = useState<FileSearchResult[]>([]);

  // Thread management state
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);

  const threadsRef = useRef<Thread[]>([]);
  const activeThreadRef = useRef<Thread | null>(null);

  console.log(threadGraphStateRef.current);

  // Update refs whenever state changes
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  useEffect(() => {
    window.addEventListener("message", handleResponse);
    return () => {
      window.removeEventListener("message", handleResponse);
    };
  }, []);

  useEffect(() => {
    if (composerMessages.length === 0) {
      setLoading(false);
    }
  }, [composerMessages]);

  const createThread = (title: string) => {
    const timestamp = Date.now();
    const newThread: Thread = {
      id: crypto.randomUUID(),
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: []
    };

    setThreads(prevThreads => [...prevThreads, newThread]);
    setActiveThread(newThread);
    setComposerMessages([]);

    vscode.postMessage({
      command: "create-thread",
      value: newThread
    });
  };

  const switchThread = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      setActiveThread(thread);

      // Load messages for this thread
      const threadMessages = thread.messages as ComposerMessage[];
      setComposerMessages(threadMessages || []);

      // Notify extension about thread switch
      vscode.postMessage({
        command: "switch-thread",
        value: threadId
      });
    }
  };

  const deleteThread = (threadId: string) => {
    // Don't delete if it's the only thread
    if (threads.length <= 1) {
      return;
    }

    setThreads(prevThreads => {
      const updatedThreads = prevThreads.filter(t => t.id !== threadId);

      // If we're deleting the active thread, switch to another one
      if (activeThread?.id === threadId && updatedThreads.length > 0) {
        const newActiveThread = updatedThreads[0];
        setActiveThread(newActiveThread);
        setComposerMessages(newActiveThread.messages as ComposerMessage[] || []);
      }

      return updatedThreads;
    });

    // Notify extension about thread deletion
    vscode.postMessage({
      command: "delete-thread",
      value: threadId
    });
  };

  const branchThread = (threadId: string) => {
    const originalThread = threads.find(t => t.id === threadId);
    if (!originalThread) return;

    const timestamp = Date.now();
    const newThread: Thread = {
      id: crypto.randomUUID(),
      title: `Branch: ${originalThread.title}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [...originalThread.messages],
      originatingThreadId: originalThread.id
    };

    setThreads(prevThreads => [...prevThreads, newThread]);
    setActiveThread(newThread);
    vscode.postMessage({
      command: "branch-thread",
      value: newThread
    });
  }

  const renameThread = (threadId: string, newTitle: string) => {
    setThreads(prevThreads => {
      return prevThreads.map(thread => {
        if (thread.id === threadId) {
          const updatedThread = {
            ...thread,
            title: newTitle,
            updatedAt: Date.now()
          };

          // Update active thread if it's the one being renamed
          if (activeThread?.id === threadId) {
            setActiveThread(updatedThread);
          }

          return updatedThread;
        }
        return thread;
      });
    });

    // Notify extension about thread rename
    vscode.postMessage({
      command: "rename-thread",
      value: { threadId, title: newTitle } satisfies RenameThreadEvent
    });
  };

  const handleComposerEvent = (value: ComposerResponse) => {
    const { step, events, state, threadId } = value;

    if (state && threadId) {
      threadGraphStateRef.current.set(threadId, state);
    }

    console.log('Update:', threadId, state, threadGraphStateRef.current);

    switch (step) {
      case "composer-done": {
        const newMessage = {
          from: "assistant" as const,
          message: activeMessage?.message ?? "",
          events,
          threadId: activeThread?.id,
          loading: false
        };

        setComposerMessages(prevMessages => [
          ...prevMessages,
          newMessage
        ]);

        // Get the latest graph state from our ref
        const currentThreadState = threadGraphStateRef.current.get(threadId);
        const modifiedState = currentThreadState ? {
          ...currentThreadState,
          messages: []
        } : undefined;

        vscode.postMessage({
          command: "add-message-to-thread",
          value: {
            threadId: threadId,
            message: newMessage,
            state: modifiedState
          } satisfies AddMessageToThreadEvent
        });

        setLoading(false);
        setActiveMessage(undefined);
        break;
      }
      case "composer-events":
        if (!loading) {
          setLoading(true);
        }
        setActiveMessage((am) => {
          return {
            from: "assistant",
            message: am?.message || "",
            events,
            threadId,
            loading: true
          }
        });
        break;
    }
  };

  const handleResponse = (event: MessageEvent<AppMessage>) => {
    const { data } = event;
    const { command, value } = data;

    switch (command) {
      case "compose-response":
        handleComposerEvent(value as ComposerResponse);
        break;
      case "thread-data": {
        const workspaceSettings = value as AppState;
        const { threads, activeThreadId } = workspaceSettings;

        // Handle threads data from extension
        if (threads && Array.isArray(threads)) {
          setThreads(threads);

          console.log(threads);
          // Set active thread if available
          if (activeThreadId && threads.length > 0) {
            const thread = threads.find((t: Thread) => t.id === activeThreadId);
            if (thread) {
              setActiveThread(thread);
              setComposerMessages(thread.messages as ComposerMessage[] || []);
            }
          } else if (threads.length > 0) {
            // Default to first thread if no active thread is specified
            setActiveThread(threads[0]);
            setComposerMessages(threads[0].messages as ComposerMessage[] || []);
          }

          const newMap = new Map(threadGraphStateRef.current);
          threadGraphStateRef.current = threads.reduce((acc, thread) => {
            if (thread.graphState) {
              acc.set(thread.id, thread.graphState);
            }
            return acc;
          }, newMap);
        }
        break;
      }
    }
  };

  const clearActiveMessage = () => {
    const cancelledMessage = {
      from: "assistant" as const,
      message: activeMessage?.message ?? "",
      threadId: activeThread?.id,
      loading: false
    };

    setComposerMessages((currentMessages) => {
      return [
        ...currentMessages,
        cancelledMessage
      ];
    });

    // Update thread with cancelled message
    if (activeThread) {
      setThreads(prevThreads => {
        return prevThreads.map(thread => {
          if (thread.id === activeThread.id) {
            return {
              ...thread,
              messages: [...thread.messages, cancelledMessage],
              updatedAt: Date.now()
            };
          }
          return thread;
        });
      });

    }

    setActiveMessage(undefined);
    setLoading(false);
  }

  return (
    <ComposerContext.Provider value={{
      composerMessages,
      setComposerMessages,
      loading, setLoading,
      activeMessage,
      clearActiveMessage,
      activeThreadGraphState: threadGraphStateRef.current.get(activeThread?.id ?? ''),
      activeFiles: chips,
      setActiveFiles: setChips,
      // Thread management
      threads,
      activeThread,
      branchThread,
      createThread,
      switchThread,
      deleteThread,
      renameThread
    }}>
      {children}
    </ComposerContext.Provider>
  );
};