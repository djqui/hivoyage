package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;

@Service
public class UserService {

    @Autowired
    private UserRepository repo;

    public void save(User user) {
        if (!user.getPassword().equals(user.getConfirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match!");
        }
        repo.save(user);
    }
}
