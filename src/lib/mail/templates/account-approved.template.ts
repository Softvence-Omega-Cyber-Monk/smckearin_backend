export const accountApprovedTemplate = ({
  name,
  accountType,
  loginLink,
}: {
  name: string;
  accountType: string;
  loginLink: string;
}) => `
  <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
    <h2 style="margin-bottom: 12px;">Your ${accountType} account is approved</h2>
    <p>Hello ${name},</p>
    <p>Your ${accountType.toLowerCase()} account has been approved. You can now sign in and start using the platform.</p>
    <p>
      <a
        href="${loginLink}"
        style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
      >
        Sign In
      </a>
    </p>
    <p>If you did not expect this email, you can safely ignore it.</p>
  </div>
`;
