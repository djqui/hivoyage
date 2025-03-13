package com.example.demo.service;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User save(User user) {
        System.out.println("🔹 Inside UserService.save() for: " + user.getEmail());
    
        if (userRepository.findByEmail(user.getEmail()) != null) {
            System.out.println("❌ Email already exists: " + user.getEmail());
            throw new IllegalArgumentException("Email already in use!");
        }
    
        user.setPassword(passwordEncoder.encode(user.getPassword()));
    
        User savedUser = userRepository.save(user);
    
        if (savedUser != null) {
            System.out.println("✅ User successfully saved: " + savedUser.getEmail());
        } else {
            System.out.println("❌ Failed to save user.");
        }
    
        return savedUser;
    }
    
    

}
