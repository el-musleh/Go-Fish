import { LoginPanel } from "../../components/login-panel";

export default function LoginPage() {
  return (
    <div className="gf-page-center">
      <LoginPanel callbackPath="/events/new" />
    </div>
  );
}
