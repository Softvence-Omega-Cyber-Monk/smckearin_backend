export const shelterInvitationTemplate = ({
  title,
  name,
  shelterName,
  email,
  password,
  loginLink,
  footer,
}: {
  title: string;
  name: string;
  shelterName: string;
  email: string;
  password: string;
  loginLink: string;
  footer: string;
}) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }
    .header { text-align: center; margin-bottom: 20px; }
    .content { background: #fff; padding: 20px; border-radius: 8px; }
    .credentials { background: #f0f0f0; padding: 15px; border-radius: 4px; margin: 20px 0; font-family: monospace; }
    .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${title}</h2>
    </div>
    <div class="content">
      <p>Hello <strong>${name}</strong>,</p>
      <p>You have been invited to join <strong>${shelterName}</strong>.</p>
      <p>Here are your login credentials:</p>
      <div class="credentials">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <center>
        <a href="${loginLink}" class="button" style="color: white;">Login to Dashboard</a>
      </center>
    </div>
    <div class="footer">
      <p>${footer}</p>
    </div>
  </div>
</body>
</html>
`;
