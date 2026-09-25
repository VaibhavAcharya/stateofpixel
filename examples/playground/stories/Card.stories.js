export default {
  title: "Card",
  render: ({ title, body }) =>
    `<div class="card"><h2>${title}</h2><p>${body}</p></div>`,
};

export const Default = {
  args: {
    title: "Visual review",
    body: "Screenshots come from your CI. We store them and compare them with the baseline.",
  },
};
