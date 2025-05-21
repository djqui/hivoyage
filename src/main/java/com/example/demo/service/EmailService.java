package com.example.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import com.example.demo.model.User;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;
    
    @Value("${app.base-url}")
    private String baseUrl;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // 🔹 Send Email Verification Link
    public void sendVerificationEmail(User user) {
        String verifyUrl = baseUrl + "/user/verify?token=" + user.getVerificationToken();

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(user.getEmail());
            message.setSubject("Confirm Your Email");
            message.setText("Hello " + user.getFirstName() + ",\n\n"
                + "Thank you for signing up! Please verify your email by clicking the link below:\n"
                + verifyUrl + "\n\n"
                + "If you did not register, please ignore this email.\n\n"
                + "Best regards,\nHiVoyage Team");

            System.out.println("📧 Attempting to send verification email to " + user.getEmail() + " from " + fromEmail);
            mailSender.send(message);
            System.out.println("📧 Verification email sent successfully to " + user.getEmail());
        } catch (Exception e) {
            System.out.println("❌ Failed to send verification email: " + e.getMessage());
            System.out.println("❌ Exception type: " + e.getClass().getName());
            e.printStackTrace();
            // Rethrow to be handled by the service
            throw new RuntimeException("Failed to send verification email. Please check your email configuration.", e);
        }
    }

    // 🔹 Send Password Reset Email
    public void sendResetPasswordEmail(String toEmail, String resetToken) {
        String resetUrl = baseUrl + "/resetpassword?token=" + resetToken;
        
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Password Reset Request");
            message.setText("Click the link below to reset your password:\n" + resetUrl + "\n\n"
                + "If you did not request this, please ignore this email.\n\n"
                + "Best regards,\nHiVoyage Team");

            System.out.println("📧 Attempting to send reset password email to " + toEmail + " from " + fromEmail);
            mailSender.send(message);
            System.out.println("📧 Reset password email sent successfully to " + toEmail);
        } catch (Exception e) {
            System.out.println("❌ Failed to send reset password email: " + e.getMessage());
            System.out.println("❌ Exception type: " + e.getClass().getName());
            e.printStackTrace();
            // Rethrow to be handled by the service
            throw new RuntimeException("Failed to send password reset email. Please check your email configuration.", e);
        }
    }
}
