package com.example.demo.service;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    @Transactional
    public User save(User user) {
        System.out.println("🔹 Inside UserService.save() for: " + user.getEmail());

        if (userRepository.findByEmail(user.getEmail()) != null) {
            System.out.println("❌ Email already exists: " + user.getEmail());
            throw new IllegalArgumentException("Email already in use!");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    @Transactional
    public void generateResetToken(String email) {
        User user = userRepository.findByEmail(email);
        if (user != null) {
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            userRepository.save(user);
            emailService.sendResetPasswordEmail(user.getEmail(), token);
        }
    }

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
