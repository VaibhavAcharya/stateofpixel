import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import {
  AuthButton,
  ConnectGithubScreen,
  SignInButton,
  SignInScreen,
  SigningIn,
} from "./SignIn";

const meta = {
  title: "App/Sign in",
  component: SignInScreen,
  parameters: { layout: "fullscreen" },
  args: { redirectTo: "/install" },
} satisfies Meta<typeof SignInScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Screen: Story = {};

export const ScreenDark: Story = { parameters: { theme: "dark" } };

export const RedirectingToGitHub: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "Continue with GitHub",
      }),
    );
  },
};

export const ExchangingCode: Story = { render: () => <SigningIn /> };

export const ConnectGithub: Story = {
  render: () => <ConnectGithubScreen redirectTo="/install" />,
};

export const AuthButtons: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap gap-3">
      <SignInButton label="Sign in" />
      <AuthButton label="Sign in" />
    </div>
  ),
};

export const AuthButtonLoading: Story = {
  parameters: { layout: "padded", auth: { isLoading: true } },
  render: () => <AuthButton label="Sign in" />,
};

export const AuthButtonSignedIn: Story = {
  parameters: { layout: "padded", auth: { isAuthenticated: true } },
  render: () => <AuthButton label="Sign in" />,
};
