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

  console.log(composerMessages);

  const handleComposerEvent = (value: ComposerResponse) => {
    const { node, values } = value;

    console.log('Active Msg:', activeMessage?.message);
    console.log('Values:', values);

    switch (node) {
      case "composer-done":
        setComposerMessages(prevMessages => [
          ...prevMessages,
          {
            from: "assistant",
            message: activeMessage?.message ?? "",
            events: values.events
          }
        ]);
        setLoading(false);
        setActiveMessage(undefined);
        break;
      case "composer-events":
        setLoading(true);
        setActiveMessage((am) => {
          return {
            from: "assistant",
            message: am?.message || "",
            events: values.events
          }
        });
        break;
    }
  }

  const handleResponse = (event: MessageEvent<AppMessage>) => {
    const { data } = event;
    const { command, value } = data;

    switch (command) {
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