package com.example.demo.service;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final FileStorageService fileStorageService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, EmailService emailService, FileStorageService fileStorageService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.fileStorageService = fileStorageService;
    }

    // 🔹 Save User & Send Email Confirmation
    @Transactional
    public User save(User user) {
        System.out.println("🔹 Inside UserService.save() for: " + user.getEmail());

        if (userRepository.findByEmail(user.getEmail()) != null) {
            System.out.println("❌ Email already exists: " + user.getEmail());
            throw new IllegalArgumentException("Email already in use!");
        }
        
        if (userRepository.findByUsername(user.getUsername()) != null) {
            System.out.println("❌ Username already exists: " + user.getUsername());
            throw new IllegalArgumentException("Username already in use!");
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

    @Transactional
    public User updateProfile(Integer userId, User updatedUser) {
        System.out.println("🔹 Starting profile update for user ID: " + userId);
        System.out.println("🔹 Birthday value received: " + updatedUser.getBirthday());

        User existingUser = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Check if username is already taken by another user
        User userWithUsername = userRepository.findByUsername(updatedUser.getUsername());
        if (userWithUsername != null && !userWithUsername.getId().equals(userId)) {
            throw new IllegalArgumentException("Username is already taken");
        }

        // Update user fields
        existingUser.setFirstName(updatedUser.getFirstName());
        existingUser.setLastName(updatedUser.getLastName());
        existingUser.setUsername(updatedUser.getUsername());
        existingUser.setBirthday(updatedUser.getBirthday());
        existingUser.setLocation(updatedUser.getLocation());

        System.out.println("🔹 Birthday value before save: " + existingUser.getBirthday());
        User savedUser = userRepository.save(existingUser);
        System.out.println("✅ Birthday value after save: " + savedUser.getBirthday());

        return savedUser;
    }

    @Transactional
    public User updateProfilePicture(Integer userId, MultipartFile file) {
        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

            // Delete old profile picture if it exists
            if (user.getProfilePicture() != null) {
                fileStorageService.deleteFile(user.getProfilePicture(), "profile-pictures");
            }

            // Store new profile picture
            String filename = fileStorageService.storeFile(file, "profile-pictures");
            user.setProfilePicture(filename);

            return userRepository.save(user);
        } catch (Exception ex) {
            ex.printStackTrace();
            throw ex;
        }
    }
}
