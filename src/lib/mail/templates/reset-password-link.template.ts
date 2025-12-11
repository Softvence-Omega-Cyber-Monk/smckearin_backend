export const resetPasswordLinkTemplate = ({
  title,
  message,
  code,
  footer,
  link,
}: {
  title: string;
  message: string;
  code: string;
  footer: string;
  link: string;
}) => `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 30px;">
  <div style="max-width: 550px; margin: auto; background-color: #ffffff; padding: 35px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0; font-size: 24px;">${title}</h2>
    </div>

    <!-- Message -->
    <p style="font-size: 16px; color: #444; line-height: 1.6; margin-bottom: 25px;">
      ${message}
    </p>

    <!-- OTP Code -->
    <div style="text-align: center; margin-bottom: 25px;">
      <p style="font-size: 18px; color: #555; margin-bottom: 8px;">Your one-time code:</p>
      <p style="font-size: 24px; font-weight: bold; color: #111; background-color: #f7f7f7; display: inline-block; padding: 12px 20px; border-radius: 6px; letter-spacing: 3px; border: 1px solid #ddd;">
        ${code}
      </p>
    </div>

    <!-- Reset Button -->
    <div style="text-align: center; margin-bottom: 25px;">
      <a href="${link}" 
         style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; 
                font-size: 16px; border-radius: 6px; display: inline-block;">
        Reset Password
      </a>
    </div>

    <!-- Link Fallback -->
    <p style="font-size: 14px; color: #555; text-align: center;">
      Or copy and paste this link into your browser:<br>
      <a href="${link}" style="color: #4CAF50;">${link}</a>
    </p>

    <!-- Footer -->
    <hr style="border:none; border-top:1px solid #eee; margin: 25px 0;">
    <p style="font-size: 13px; color: #999; text-align: center; margin: 0;">
      ${footer}
    </p>

  </div>
</div>
`;
