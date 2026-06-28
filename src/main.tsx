import ReactDOM from "react-dom/client";
import App from "./App";
import Popup from "./Popup";
import "./App.css";

const isPopup = new URLSearchParams(window.location.search).has("popup");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isPopup ? <Popup /> : <App />,
);
