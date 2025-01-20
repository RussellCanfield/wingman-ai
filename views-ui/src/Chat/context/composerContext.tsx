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
              files: values.files,
              dependencies: values.dependencies
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
              message: "",
              files: values.files,
              dependencies: values.dependencies
            }
          ];
        });
        setLoading(false);
        setActiveMessage(undefined);
        break;
      case "composer-files":
        setActiveMessage((msg) => {
          return {
            from: "assistant",
            message: values.userIntent?.task ?? "",
            ...msg ?? {},
            files: values.files
          }
        });
        break;
      case "composer-greeting":
        setActiveMessage((msg) => {
          return {
            from: "assistant",
            message: values.userIntent?.task ?? "",
            ...msg ?? {},
            greeting: values.greeting
          }
        });
        break;
      case "composer-files":
        setActiveMessage((msg) => {
          return {
            ...msg ?? { message: "" },
            from: "assistant",
            files: values.files
          }
        });
        break;
      case "assistant-question":
        if (mostRecentMessage) {
          setComposerMessages((currentMessages) => {
            return [
              ...currentMessages,
              {
                from: mostRecentMessage?.kwargs.role,
                message: mostRecentMessage?.kwargs.content,
              }
            ];
          });
          setLoading(false);
          setActiveMessage(undefined);
        }
        break;
    }
  }

  const handleResponse = (event: MessageEvent<AppMessage>) => {
    const { data } = event;
    const { command, value } = data;

    console.log("Composer:", command, value)

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
    setActiveMessage(undefined);
    setLoading(false);
    setComposerMessages((currentMessages) => {
      return [
        ...currentMessages,
        {
          from: "assistant",
          message: "",
        }
      ];
    });
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