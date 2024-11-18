import { ComposerMessage, ComposerRequest, ComposerResponse } from "@shared/types/Composer";
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
  currentPhase: keyof typeof phaseDisplayLabel,
  setCurrentPhase: React.Dispatch<React.SetStateAction<keyof typeof phaseDisplayLabel>>,
  clearActiveMessage: () => void,
  activeMessage: ComposerMessage | undefined;
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
	const [currentPhase, setCurrentPhase] =
		useState<keyof typeof phaseDisplayLabel>("new");
  const [activeMessage, setActiveMessage] = useState<ComposerMessage | undefined>();

    useEffect(() => {
      window.addEventListener("message", handleResponse);
  
      return () => {
        window.removeEventListener("message", handleResponse);
      };
    }, []);
  
    useEffect(() => {
      if (composerMessages.length === 0) {
        setCurrentPhase("new");
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
                },
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
            setCurrentPhase('new');
      
            return newHistory;
          });
          break;
        case "compose-response":
          if (!value) {
            return;
          }
  
          const { node, values } = value as ComposerResponse;
  
          setCurrentPhase(node as keyof typeof phaseDisplayLabel);
  
          if (node === "replan") {
            if (
              values.review &&
              values.review?.comments &&
              values.review.comments.length > 0
            ) {
              setComposerMessages((currentMessages) => {
                return [
                  ...currentMessages,
                  {
                    from: "assistant",
                    message: `There were issues with the code changes, we are correcting them! Here was my review:
                    
  ${values.review.comments.join("\n")}`,
                    plan: {
                      files: [],
                      steps: [],
                    },
                  },
                ];
              });
  
              return;
            }
  
            if (
              values.plan?.files?.length === 0 &&
              values.plan?.steps?.length === 0
            ) {
              setComposerMessages((currentMessages) => {
                return [
                  ...currentMessages,
                  {
                    from: "assistant",
                    message:
                      "Sorry something went wrong and I was not able to generate any changes.",
                    plan: {
                      files: [],
                      steps: [],
                    },
                  },
                ];
              });
              return;
            }
  
            if (
              values.review?.comments?.length > 0 &&
              values.retryCount === 0
            ) {
              setComposerMessages((currentMessages) => {
                return [
                  ...currentMessages,
                  {
                    from: "assistant",
                    message:
                      "Sorry the review failed and I was unable to correct the changes. Please try again with a more specific query.",
                    plan: {
                      files: [],
                      steps: [],
                    },
                  },
                ];
              });
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
                },
              ];
            });
          }
          break;
      }
    };

  const clearActiveMessage = () => {
    setActiveMessage(undefined);
  }

  return (
    <ComposerContext.Provider value={{ composerMessages, setComposerMessages, loading, currentPhase, setLoading, setCurrentPhase, activeMessage, clearActiveMessage }}>
      {children}
    </ComposerContext.Provider>
  );
};