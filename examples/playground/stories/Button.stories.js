export default {
  title: "Button",
  render: ({ label, primary, disabled }) =>
    `<button type="button" class="button${primary ? " primary" : ""}"${disabled ? " disabled" : ""}>${label}</button>`,
};

export const Primary = { args: { label: "Approve", primary: true } };

export const Secondary = { args: { label: "Reject" } };

export const Disabled = { args: { label: "Disabled", disabled: true } };
