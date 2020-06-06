# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = 'ubuntu/trusty64'
  config.vm.synced_folder './', '/project'

  machines = [{
    :name => 'kamailio-1',
    :role => 'kamailio',
    :address => '192.168.188.110'
  },{
    :name => 'asterisk-1',
    :role => 'asterisk',
    :address => '192.168.188.111'
  }]

  machines.each do |machine|
    config.vm.define machine[:name] do |vm_config|
      vm_config.vm.hostname = machine[:name]
      vm_config.vm.provider 'virtualbox' do |vb|
        vb.memory = 2048
        vb.cpus = 1
        vb.customize ['modifyvm', :id, '--nataliasmode1', 'proxyonly']
      end
      vm_config.vm.network 'private_network', ip: machine[:address]
      vm_config.vm.provision :shell, inline: %Q[
if ! which docker >> /dev/null; then
  sudo apt install apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
  sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu trusty stable"
  sudo apt-get update
  sudo apt-get -y install docker-ce=18.06.1~ce~3-0~ubuntu
  sudo usermod -aG docker vagrant
fi
if ! which docker-compose >> /dev/null; then
  sudo curl -L "https://github.com/docker/compose/releases/download/1.25.5/docker-compose-Linux-x86_64" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi
sudo sed -i'' '/# vagranthosts/,$d' /etc/hosts
sudo echo $'# vagranthosts\\n#{machines.select { |m| m[:name] != machine[:name] }.map { |m| "#{m[:address]} #{m[:name]}\\n" }.join(" ")}' >> /etc/hosts
sudo echo $'#!/usr/bin/env bash\\ncd /project\ndocker-compose -f docker-compose.#{machine[:role]}.yml $@' > /usr/local/bin/dc
sudo chmod +x /usr/local/bin/dc
dc up -d
]
    end
  end

end