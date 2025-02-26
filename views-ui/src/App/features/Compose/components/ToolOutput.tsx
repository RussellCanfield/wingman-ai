import { StreamEvent } from "@shared/types/v2/Composer";
import { AiOutlineLoading3Quarters, AiOutlineCheckCircle } from "react-icons/ai";

const ToolNames = {
    'list_directory': 'Searching workspace'
}

export const ToolOutput = ({ event, loading }: { event: StreamEvent, loading: boolean }) => {
    //@ts-expect-error
    const displayName = ToolNames[event.metadata?.tool];

    return (<div className="border border-stone-700/50 rounded-lg overflow-hidden shadow-lg mb-4 mt-4 bg-stone-800">
        <div className="text-white flex flex-col border-b border-stone-700/50">
            <div className="flex items-center justify-start border-b border-stone-700/50 relative">
                <h4
                    className="m-0 p-3 font-medium truncate cursor-pointer hover:underline transition-all text-sm group"
                    style={{ flex: '0 1 auto', minWidth: '0' }}
                >
                    {displayName}
                </h4>
                {loading ? (
                    <div className="flex justify-center mr-4">
                        <AiOutlineLoading3Quarters
                            className="animate-spin text-stone-400"
                            size={24}
                        />
                    </div>
                ) : (
                    <div className="flex justify-center mr-4">
                        <AiOutlineCheckCircle
                            className="text-green-500"
                            size={24}
                        />
                    </div>
                )}
            </div>
        </div>
    </div>)
}