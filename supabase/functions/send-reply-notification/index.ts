import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReplyNotificationRequest {
  studentEmail: string;
  studentName: string;
  teacherName: string;
  assignmentTitle: string;
  question: string;
  reply: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      studentEmail, 
      studentName, 
      teacherName, 
      assignmentTitle, 
      question, 
      reply 
    }: ReplyNotificationRequest = await req.json();

    console.log("Sending reply notification to:", studentEmail);

    const emailResponse = await resend.emails.send({
      from: "StudyHub <onboarding@resend.dev>",
      to: [studentEmail],
      subject: `New reply to your question on "${assignmentTitle}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .question-box { background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6366f1; }
            .reply-box { background: #dcfce7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #22c55e; }
            .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📚 New Reply to Your Question</h1>
            </div>
            <div class="content">
              <p>Hi ${studentName || 'Student'},</p>
              <p><strong>${teacherName || 'Your teacher'}</strong> has replied to your question about <strong>"${assignmentTitle}"</strong>.</p>
              
              <div class="label">Your Question</div>
              <div class="question-box">
                ${question}
              </div>
              
              <div class="label">Teacher's Reply</div>
              <div class="reply-box">
                ${reply}
              </div>
              
              <p>Log in to StudyHub to continue the conversation!</p>
              
              <div class="footer">
                <p>Happy learning! 🎓</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-reply-notification function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
