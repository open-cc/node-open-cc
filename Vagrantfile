# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = 'ubuntu/trusty64'
  config.vm.synced_folder './', '/project'

  machines = [{
    :name => 'kamailio-1',
    :roles => %w(kamailio nats),
    :address => '192.168.188.110'
  }, {
    :name => 'asterisk-1',
    :roles => %w(asterisk core example),
    :address => '192.168.188.111'
  }].map { |m|
    m[:compose_files] = m[:roles]
      .map { |role| "docker-compose.#{role}.yml" }
      .select { |file| File.exist?(file) }
    m
  }

  machines_by_role = machines
    .map { |m| m[:roles] }
    .flatten
    .uniq
    .reduce([]) { |by_role, role|
      by_role << {
        :role => role
          .upcase
          .gsub(/[^a-z0-9]+/i, '_'),
        :machines => machines
          .select { |m| m[:roles].include? role } }
      by_role
    }

  machines.each { |m|
    m[:env] = {
      :CWD => '/project',
      :COMPOSE_ARGS => m[:roles]
        .map { |role| "docker-compose.#{role}.yml" }
        .select { |file| File.exist?(file) }
        .map { |file| "-f #{file}" }
        .join(' '),
      :MACHINE_KEY => Array.new(32) { [*'a'..'z', *'0'..'0'].sample }.join,
      :PRIVATE_IPV4 => m[:address]
    }
    machines.each { |m1|
      m[:env]["#{m[:name].upcase.gsub(/[^a-z0-9]+/i, '_')}_PRIVATE_IPV4"] = m1[:address]
    }
    machines_by_role.each { |role_group|
      m[:env]["#{role_group[:role]}_PRIVATE_IPV4"] = role_group[:machines].map { |rm| rm[:address] }.join(' ')
    }
  }

  machines.each do |machine|

    config.vm.define machine[:name] do |vm_config|
      vm_config.vm.hostname = machine[:name]
      vm_config.vm.provider 'virtualbox' do |vb|
        vb.memory = 2048
        vb.cpus = 1
        vb.customize ['modifyvm', :id, '--nataliasmode1', 'proxyonly']
      end
      vm_config.vm.network 'private_network', ip: machine[:address]
      vm_config.vm.provision :file, source: './dc.sh', destination: '/tmp/dc'
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
sudo echo $'# vagranthosts\n#{machines
        .select { |m| m[:name] != machine[:name] }
        .map { |m| "#{m[:address]} #{m[:name]}\\n" }
        .join(" ")}' >> /etc/hosts
sudo mv /tmp/dc /usr/local/bin/dc
sudo chmod +x /usr/local/bin/dc
]
      vm_config.vm.provision :shell, privileged: false, inline: %Q[
echo $'#{machine[:env].map { |name, value| "export #{name}=\"#{value}\"" }.join("\n")}' > $HOME/.dcrc
]
    end
  end

end