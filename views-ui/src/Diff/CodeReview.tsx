import { DiffViewCommand } from "@shared/types/Composer";
import DiffView from "./DiffView";

export interface CodeReviewProps {
	diffs: DiffViewCommand[];
}

export default function CodeReview({ diffs }: CodeReviewProps) {
	return (
		<section>
			<p>Title</p>
			<div className="flex flex-row gap-4">
				{diffs.map((diff) => (
					<DiffView key={diff.file} diff={diff} />
				))}
			</div>
		</section>
	);
}
