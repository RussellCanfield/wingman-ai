import { ComposerMessage, ComposerRequest, ComposerResponse, FileSearchResult, Plan } from "@shared/types/Composer";
import { AppMessage } from "@shared/types/Message";
import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";

export type PhaseLabel = {
  new: "Planning";
  planner: "Writing Code";
  "code-writer": "Reviewing";
  replan: "Preparing Results";
};

export const phaseDisplayLabel: PhaseLabel = {
  new: "Planning",
  planner: "Writing Code",
  "code-writer": "Reviewing",
  replan: "Preparing Results",
};

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
              plan: {
                files: [],
                steps: [],
              } satisfies Plan,
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
        if (!value) {
          return;
        }

        const { node, values } = value as ComposerResponse;

        if (node === "composer-error") {
          let failedErrorMsg: string | undefined;
          if (
            values.review &&
            values.review?.comments &&
            values.review.comments.length > 0
          ) {
            failedErrorMsg = `There were issues with the code changes, we are correcting them! Here was my review:
                  
${values.review.comments.join("\n")}`
          } else if (
            values.plan?.files?.length === 0 &&
            values.plan?.steps?.length === 0
          ) {
            failedErrorMsg = "Sorry something went wrong and I was not able to generate any changes.";
          } else if (
            values.review?.comments &&
            values.review?.comments?.length > 0 &&
            values.retryCount === 0
          ) {
            failedErrorMsg = "Sorry the review failed and I was unable to correct the changes. Please try again with a more specific query.";
          }

          if (failedErrorMsg) {
            setComposerMessages((currentMessages) => {
              return [
                ...currentMessages,
                {
                  from: "assistant",
                  message: failedErrorMsg || "Unknown error occurred.",
                  plan: {
                    files: [],
                    steps: [],
                    planningSteps: []
                  },
                },
              ];
            });

            setLoading(false);
            return;
          }

          setLoading(false);
          setComposerMessages((currentMessages) => {
            return [
              ...currentMessages,
              {
                from: "assistant",
                message: values.response!,
                plan: values.plan!,
              }
            ];
          });
        } else {
          if (node === 'composer-done') {
            setLoading(false);
            setComposerMessages((currentMessages) => {
              return [
                ...currentMessages,
                {
                  from: "assistant",
                  message: values.plan?.summary || "",
                  plan: values.plan!,
                }
              ];
            });
            setActiveMessage(undefined);
          } else {
            setActiveMessage(activeMsg => ({
              ...activeMsg,
              from: "assistant",
              message: values.plan?.summary || "",
              loading: true,
              plan: values.plan ?? {
                files: [],
                steps: []
              }
            }));

            const activeFiles = values.plan?.files?.map(f => {
              const fileName = f.path.split(/[/\\]/).pop() || "";
              return {
                file: fileName,
                path: f.path
              } satisfies FileSearchResult;
            });

            setChips(activeFiles ?? [])
          }
        }
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
          message: activeMessage?.plan.summary || activeMessage?.message || "",
          plan: activeMessage?.plan ?? {
            files: [],
            steps: []
          }
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