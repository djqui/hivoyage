package com.example.demo.service;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    // 🔹 Save User & Send Email Confirmation
    @Transactional
    public User save(User user) {
        System.out.println("🔹 Inside UserService.save() for: " + user.getEmail());

        if (userRepository.findByEmail(user.getEmail()) != null) {
            System.out.println("❌ Email already exists: " + user.getEmail());
            throw new IllegalArgumentException("Email already in use!");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setEnabled(false); // User disabled until email is verified
        user.setVerificationToken(UUID.randomUUID().toString());

        User savedUser = userRepository.save(user);
        emailService.sendVerificationEmail(savedUser); // Send email verification

        return savedUser;
    }

    // 🔹 Verify User Email
    @Transactional
    public boolean verifyEmail(String token) {
        User user = userRepository.findByVerificationToken(token);
        
        if (user == null) {
            return false; // Invalid token
        }
    
        user.setEnabled(true); // Enable the user
        user.setVerificationToken(null); // Clear verification token
        userRepository.save(user); // Ensure changes are persisted
    
        System.out.println("✅ Email verified! User is now enabled: " + user.getEmail());
        return true;
    }
    

    // 🔹 Generate Password Reset Token
    @Transactional
    public void generateResetToken(String email) {
        User user = userRepository.findByEmail(email);
        if (user != null) {
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            userRepository.save(user);
            emailService.sendResetPasswordEmail(user.getEmail(), token);
        } else {
            throw new IllegalArgumentException("❌ No account found with this email.");
        }
    }

    // 🔹 Check If Reset Token is Valid
    @Transactional(readOnly = true)
    public boolean isValidResetToken(String token) {
        User user = userRepository.findByResetToken(token);
        return user != null;
    }

    // 🔹 Reset Password
    @Transactional
    public boolean resetPassword(String token, String newPassword) {
        System.out.println("🔍 Received token: " + token);
        
        User user = userRepository.findByResetToken(token);
        if (user == null) {
            System.out.println("❌ No user found for token: " + token);
            return false;
        }
    
        System.out.println("✅ User found: " + user.getEmail());
    
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null); // Clear token
        userRepository.saveAndFlush(user);
    
        System.out.println("🔐 Password updated successfully for: " + user.getEmail());
        return true;
    }
}
