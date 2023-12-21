import ReactDOM from "react-dom";
import App from "./App";
import { createGlobalStyle } from "styled-components";

const FontStyles = createGlobalStyle`
	@font-face {
		font-family: 'Roboto';
		src: url(./Roboto-Medium.ttf) format('truetype');
		font-weight: normal;
		font-style: normal;
	}
`;

ReactDOM.render(
	<>
		<FontStyles />
		<App />
	</>,
	document.getElementById("root")
);
