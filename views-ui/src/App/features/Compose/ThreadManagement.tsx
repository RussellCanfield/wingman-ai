import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { TbNeedleThread } from "react-icons/tb";
import { useComposerContext } from '../../context/composerContext';
import { PiGraph } from "react-icons/pi";
import { vscode } from '../../utilities/vscode';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import type { ComposerThread } from '@shared/types/Composer';

export const /**
* ThreadManagement component for managing conversation threads.
* Provides UI for creating, switching, renaming, branching, and deleting threads.
* 
* @returns {JSX.Element} The rendered ThreadManagement component
*/
  ThreadManagement = ({ loading }: { loading: boolean }) => {
    const { threads, activeThread, createThread, switchThread, deleteThread, renameThread, branchThread, activeComposerState } = useComposerContext();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCreatingThread, setIsCreatingThread] = useState(false);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const newThreadInputRef = useRef<HTMLInputElement>(null);
    const editThreadInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    // Focus input when creating a new thread
    useEffect(() => {
      if (isCreatingThread && newThreadInputRef.current) {
        newThreadInputRef.current.focus();
      }
    }, [isCreatingThread]);

    // Focus input when editing a thread
    useEffect(() => {
      if (editingThreadId && editThreadInputRef.current) {
        editThreadInputRef.current.focus();
      }
    }, [editingThreadId]);

    const handleCreateThread = () => {
      if (newThreadTitle.trim()) {
        createThread(newThreadTitle.trim());
        setNewThreadTitle('');
        setIsCreatingThread(false);
        setIsDropdownOpen(false);
      }
    };

    const handleSaveThreadTitle = () => {
      if (editingThreadId && editingTitle.trim()) {
        renameThread(editingThreadId, editingTitle.trim());
        setEditingThreadId(null);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent, action: 'create' | 'edit') => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (action === 'create') {
          handleCreateThread();
        } else {
          handleSaveThreadTitle();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (action === 'create') {
          setIsCreatingThread(false);
        } else {
          setEditingThreadId(null);
        }
      }
    };

    const visualizeThreads = () => {
      vscode.postMessage({
        command: 'visualize-threads'
      })
    }

    const startEditingThread = (thread: ComposerThread, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingThreadId(thread.id);
      setEditingTitle(thread.title);
    };

    const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteThread(threadId);
    };

    const handleBranchThread = (threadId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      branchThread(threadId);
      setIsDropdownOpen(false);
    };

    const handleEditInputKeyDown = (e: React.KeyboardEvent) => {
      e.stopPropagation();

      // Handle specific keys
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveThreadTitle();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingThreadId(null);
      }
    };

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <div className='flex align-middle items-center gap-2'>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`
    flex items-center gap-2 px-3 py-1.5 rounded-md 
    hover:bg-[var(--vscode-button-hoverBackground)] 
    transition-colors relative overflow-hidden
    ${loading ? 'animate-pulse' : ''}
  `}
            aria-label="Manage threads"
          >
            {loading && (
              <div className="absolute inset-0 -z-10">
                <div className="w-full h-full animate-shimmer bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent"
                  style={{
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite linear'
                  }}
                />
              </div>
            )}
            <TbNeedleThread size={20} />
            <span className="truncate max-w-[150px]">
              {activeThread?.title || 'New Thread'}
            </span>
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 w-64 rounded-md shadow-lg bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)]">
              <div className="py-1 max-h-[400px] overflow-y-auto">
                <div className="px-3 py-2 text-sm font-medium text-[var(--vscode-foreground)] border-b border-[var(--vscode-dropdown-border)]">
                  Threads
                </div>

                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`px-3 py-2 hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer ${activeThread?.id === thread.id ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : ''
                      }`}
                    onClick={() => {
                      switchThread(thread.id);
                      setIsDropdownOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        switchThread(thread.id);
                        setIsDropdownOpen(false);
                      }
                    }}
                  >
                    <div className="flex justify-between items-center">
                      {activeComposerState?.threadId === thread.id && loading && (
                        <div className="flex justify-center mr-4">
                          <AiOutlineLoading3Quarters
                            className="animate-spin text-stone-400"
                            size={16}
                          />
                        </div>
                      )}
                      {editingThreadId === thread.id ? (
                        <input
                          ref={editThreadInputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={handleSaveThreadTitle}
                          onKeyDown={handleEditInputKeyDown}
                          className="flex-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex-1 truncate">{thread.title}</div>
                      )}

                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={(e) => startEditingThread(thread, e)}
                          className="p-1 hover:bg-[var(--vscode-button-hoverBackground)] rounded"
                          aria-label="Edit thread name"
                        >
                          {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleBranchThread(thread.id, e)}
                          className="p-1 hover:bg-[var(--vscode-button-hoverBackground)] rounded"
                          aria-label="Branch thread"
                        >
                          {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="6" y1="3" x2="6" y2="15" />
                            <circle cx="18" cy="6" r="3" />
                            <circle cx="6" cy="18" r="3" />
                            <path d="M18 9a9 9 0 0 1-9 9" />
                          </svg>
                        </button>
                        {threads.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteThread(thread.id, e)}
                            className="p-1 hover:bg-[var(--vscode-button-hoverBackground)] rounded text-[var(--vscode-errorForeground)]"
                            aria-label="Delete thread"
                          >
                            {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
                      {formatDate(thread.createdAt)}
                    </div>
                  </div>
                ))}

                {isCreatingThread ? (
                  <div className="px-3 py-2">
                    <input
                      ref={newThreadInputRef}
                      type="text"
                      placeholder="Thread name"
                      value={newThreadTitle}
                      onChange={(e) => setNewThreadTitle(e.target.value)}
                      onBlur={() => {
                        if (!newThreadTitle.trim()) {
                          setIsCreatingThread(false);
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, 'create')}
                      className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded px-2 py-1"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingThread(false)}
                        className="px-2 py-1 text-sm rounded hover:bg-[var(--vscode-button-hoverBackground)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateThread}
                        className="px-2 py-1 text-sm bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)]"
                        disabled={!newThreadTitle.trim()}
                      >
                        Create
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="px-3 py-2 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer flex items-center gap-2"
                    onClick={() => setIsCreatingThread(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsCreatingThread(true);
                      }
                    }}
                  >
                    {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>New Thread</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => visualizeThreads()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
          aria-label="Visualize threads"
        >
          <PiGraph size={20} />
        </button>
      </div>
    );
  };

export default ThreadManagement;