import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="w-full max-w-md">
      <SignIn />
    </div>
  );
}
