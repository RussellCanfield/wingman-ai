import { ComposerMessage, ComposerRequest, ComposerResponse, FileSearchResult } from "@shared/types/v2/Composer";
import { AppMessage } from "@shared/types/v2/Message";
import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";

interface ComposerContextType {
  composerMessages: ComposerMessage[];
  setComposerMessages: React.Dispatch<React.SetStateAction<ComposerMessage[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  clearActiveMessage: () => void,
  activeMessage: ComposerMessage | undefined;
  activeFiles: FileSearchResult[];
  setActiveFiles: React.Dispatch<React.SetStateAction<FileSearchResult[]>>;
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
  const [chips, setChips] = useState<FileSearchResult[]>([]);

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

  const handleComposerEvent = (value: ComposerResponse) => {
    const { node, values } = value;

    const mostRecentMessage = values.messages ? values.messages[values.messages!.length - 1] : undefined;
    const lastSafeAssistantMsg = (mostRecentMessage?.kwargs.role === "user" ? activeMessage?.message : mostRecentMessage?.kwargs.content) || "";

    console.log('Active Msg:', activeMessage?.message);
    console.log('Values:', values);

    switch (node) {
      case "composer-replace":
        setComposerMessages((currentMessages) => {
          const lastMessage = currentMessages[currentMessages.length - 1];
          const messagesWithoutLast = currentMessages.slice(0, -1);

          return [
            ...messagesWithoutLast,
            {
              ...lastMessage,
              files: values.files,
            }
          ];
        });
        break;
      case "composer-error":
        setComposerMessages((currentMessages) => {
          return [
            ...currentMessages,
            {
              from: "assistant",
              message: values.error ?? "Ut oh! Sorry but I seem to have failed processing your request. Please try again!",
              files: [],
            }
          ];
        });
        setLoading(false);
        setActiveMessage(undefined);
        break;
      case "composer-done":
        setComposerMessages((currentMessages) => {
          return [
            ...currentMessages,
            {
              from: "assistant",
              message: lastSafeAssistantMsg,
              files: []
            }
          ];
        });
        setLoading(false);
        setActiveMessage(undefined);
        break;
      case "composer-files-done":
        setComposerMessages((currentMessages) => {
          return [
            ...currentMessages,
            {
              from: "assistant",
              message: lastSafeAssistantMsg,
              files: values.files
            },
          ];
        });
        setLoading(false);
        setActiveMessage(undefined);
        break;
      case "composer-files":
        setLoading(true);
        setActiveMessage((am) => {
          return {
            from: "assistant",
            message: am?.message || "",
            files: values.files
          }
        });
        break;
      case "composer-message-stream-finish":
        setComposerMessages((currentMessages) => {
          return [
            ...currentMessages,
            {
              from: "assistant",
              message: activeMessage?.message || lastSafeAssistantMsg,
              files: activeMessage?.files ?? values.files ?? []
            }
          ];
        });
        setLoading(false);
        setActiveMessage(undefined);
        break;
      case "composer-message-stream":
        setLoading(true);
        setActiveMessage((msg) => {
          return {
            ...msg ?? {},
            from: "assistant",
            message: values as string
          }
        });
        break;
    }
  }

  const handleResponse = (event: MessageEvent<AppMessage>) => {
    const { data } = event;
    const { command, value } = data;

    switch (command) {
      case "validation-failed":
        setComposerMessages((messages) => {
          const newHistory: ComposerMessage[] = [
            ...messages,
            {
              from: "assistant",
              message: String(value),
              loading: false,
            },
          ];

          vscode.postMessage({
            command: "compose",
            value: {
              input: String(value),
              contextFiles: []
            } satisfies ComposerRequest,
          });

          setLoading(true);

          return newHistory;
        });
        break;
      case "compose-response":
        handleComposerEvent(value as ComposerResponse);
        break;
    }
  };

  const clearActiveMessage = () => {
    setComposerMessages((currentMessages) => {
      return [
        ...currentMessages,
        {
          from: "assistant",
          message: activeMessage?.message ?? "",
        }
      ];
    });
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
      activeFiles: chips,
      setActiveFiles: setChips,
    }}>
      {children}
    </ComposerContext.Provider>
  );
};