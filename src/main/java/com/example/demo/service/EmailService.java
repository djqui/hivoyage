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

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // 🔹 Send Email Verification Link
    public void sendVerificationEmail(User user) {
        String verifyUrl = "http://localhost:8080/user/verify?token=" + user.getVerificationToken();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(user.getEmail());
        message.setSubject("Confirm Your Email");
        message.setText("Hello " + user.getFirstName() + ",\n\n"
            + "Thank you for signing up! Please verify your email by clicking the link below:\n"
            + verifyUrl + "\n\n"
            + "If you did not register, please ignore this email.\n\n"
            + "Best regards,\nHiVoyage Team");

        mailSender.send(message);
        System.out.println("📧 Verification email sent to " + user.getEmail());
    }

    // 🔹 Send Password Reset Email
    public void sendResetPasswordEmail(String toEmail, String resetToken) {
        String resetUrl = "http://localhost:8080/resetpassword?token=" + resetToken;
        
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("Password Reset Request");
        message.setText("Click the link below to reset your password:\n" + resetUrl + "\n\n"
            + "If you did not request this, please ignore this email.\n\n"
            + "Best regards,\nHiVoyage Team");

        mailSender.send(message);
        System.out.println("📧 Reset password email sent to " + toEmail);
    }
}
