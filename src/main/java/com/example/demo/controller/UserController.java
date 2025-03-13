package com.example.demo.controller;

import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/user/signup")
    public String showSignupPage(Model model) {
        model.addAttribute("user", new User());
        return "signup";
    }

    @PostMapping("/user/validate")
    public String validateUser(@ModelAttribute User user, Model model) {
        System.out.println("🔹 Received registration request for: " + user.getEmail());
        try {
            if (user.getEmail() == null || user.getPassword() == null) {
                System.out.println("❌ Registration failed: Email or Password is missing.");
                model.addAttribute("error", "Email and password are required.");
                return "signup";
            }
            
            User savedUser = userService.save(user);
            if (savedUser == null) {
                System.out.println("❌ Registration failed: UserService returned null.");
                model.addAttribute("error", "User registration failed!");
                return "signup";
            }
            
            System.out.println("✅ Registration successful: " + savedUser.getEmail());
            return "redirect:/login";
        } catch (Exception e) {
            System.out.println("❌ Registration error: " + e.getMessage());
            e.printStackTrace();
            model.addAttribute("error", "Error: " + e.getMessage());
            return "signup";
        }
    }

    @GetMapping("/login")
    public String showLoginPage(@RequestParam(value = "error", required = false) String error,
                                @RequestParam(value = "logout", required = false) String logout,
                                Model model) {
        if (error != null) {
            model.addAttribute("errorMessage", "Invalid email or password.");
        }
        if (logout != null) {
            model.addAttribute("logoutMessage", "You have been logged out.");
        }
        return "login";
    }

    @GetMapping("/user/homepage")
    public String showHomePage(Model model) {
        model.addAttribute("user", new User());
        return "homepage";
    }
}
